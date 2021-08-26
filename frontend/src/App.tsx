import {
  Container,
  Divider,
  Header,
  List,
  Menu,
  Segment,
  Button,
  Form
} from 'semantic-ui-react'
import QRCode from "react-qr-code";
import { useReducer, useState } from 'react';
import SemanticDatepicker from 'react-semantic-ui-datepickers';
import 'react-semantic-ui-datepickers/dist/react-semantic-ui-datepickers.css';
import moment from 'moment';


const MODE_FORM = "FORM";
const MODE_VC = "VC";

const initialState = {
  mode: MODE_FORM,
  vc: ''

}

const API_URL = process.env.REACT_APP_API || "https://issuer-ta.trackback.dev"

type AppState = typeof initialState;

type ActionType = {
  type: string;
  payload: any
}

const reducer = (state: AppState, action: ActionType) => {

  switch (action.type) {

    case "vc": {
      return { ...state, vc: action.payload }
    }

    case "mode": {
      return { ...state, mode: action.payload }
    }

    default:
      return state
  }
}

const UploadImage = (formData: any) => {
  return fetch(`${API_URL}/api/v1/image-upload`, {
    method: 'POST',
    body: formData
  })
}

const createVerifiableCredential = (data: { [key: string]: string }) => {
  return fetch(`${API_URL}/api/v1/register`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...data })
  })

}

const useInput = (initialValue: string) => {
  const [value, setValue] = useState(initialValue);

  return {
    value,
    setValue,
    reset: () => setValue(""),
    bind: {
      value,
      onChange: (event: any) => {
        setValue(event.target.value);
      }
    }
  };
};

type Props = {
  save: (data: any) => void
}

const FormPassport = ({ save }: Props) => {

  const [file, setFile] = useState<any>();
  const [loading, setLoading] = useState(false);

  const { value: firstName, bind: bindFirstName, } = useInput('');
  const { value: lastName, bind: bindLastName, } = useInput('');
  const { value: dob, bind: bindDob } = useInput('');

  const showFile = async (e: any) => {
    e.preventDefault()

    setLoading(true)

    const files: Blob[] = Array.from(e.target.files)
    const formData = new FormData()

    files.forEach((file: Blob, i: Number) => {
      formData.append(`${i}`, file)
    })

    UploadImage(formData)
      .then(res => res.json())
      .then(res => {
        setFile(res)
      }).catch((e) => {
      }).finally(() => {

        setLoading(false)
      })

  }

  const handleSave = () => {
    if (!file) return;
    setLoading(true);
    save({ firstName, lastName, dob, file })
  }

  return (
    <Form loading={loading}>
      <Header as='h3' textAlign='left' content='New Licence' style={
        {
          marginTop: '2em',
          padding: '2em 0em',
        }
      } />
      <Form.Field>
        <label>First Name</label>
        <input placeholder='First Name' {...bindFirstName} />
      </Form.Field>
      <Form.Field>
        <label>Last Name</label>
        <input placeholder='Last Name' {...bindLastName} />
      </Form.Field>
      <Form.Field>
        <label>Date of Birth (yyyy-mm-dd)</label>
        <SemanticDatepicker format='YYYY-MM-DD' onChange={(e, d) => {
          if (!d || !d.value) return;
          // @ts-ignore
          const date = moment(d.value).format("YYYY-MM-DD")
       
          bindDob.onChange({ target: { value: date } })
        }
        } />
      </Form.Field>
      <Form.Field>
        <label>Photo</label>
        <input type="file" onChange={(e) => showFile(e)} />
      </Form.Field>

      <Button type='button' onClick={handleSave}>Submit</Button>
    </Form>
  )
}


const QR_VC = ({ value }: { [key: string]: string }) => {
  return (
    <div>
      <Header as='h3' textAlign='center' content='Scan QR Code (Track-Back Wallet)' style={
        {
          marginTop: '2em',
          padding: '2em 0em',
        }
      } />
      <Container textAlign='center'>
        <QRCode value={value} />
      </Container>
    </div>
  )
}

const bloodTypes = ["A", "B", "AB", "O"];
const rh = ["+", "-"]

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function randomBloodType() {
  return `${bloodTypes[getRandomInt(bloodTypes.length)]}${rh[getRandomInt(rh.length)]}`
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState)


  const save = ({ firstName, lastName, dob, file }: { firstName: string, lastName: string, dob: string, file: any }) => {

    createVerifiableCredential({
      firstName,
      lastName,
      dob,
      photo: file.data.key,
      imageHash: file.hash,
      bloodType: randomBloodType()
    })
      .then(res => res.json())
      .then(res => {
        console.log(res)

        const payload = JSON.stringify(res);

        dispatch({ type: "vc", payload: payload })
        dispatch({ type: "mode", payload: MODE_VC })
      }).catch((e) => {
        dispatch({ type: "mode", payload: MODE_FORM })
      }).finally(() => {

      })
  }


  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Menu fixed='top' inverted>
        <Container>
          <Menu.Item as='a' header active={false}>

            Trackback Transport Athority
          </Menu.Item>
          <Menu.Item as='' href='/'>Home</Menu.Item>


        </Container>
      </Menu>

      <Container text style={{ marginTop: '7em', minHeight: 500, position: 'relative', flex: 1 }}>
        <Header as='h1'></Header>

        {state.mode === MODE_FORM && <FormPassport save={save} />}

        {state.mode === MODE_VC && <QR_VC value={state.vc} />}

      </Container>

      <Segment inverted color="black" vertical style={{ margin: '5em 0em 0em', padding: '5em 0em', position: 'relative', bottom: 0 }} >
        <Container textAlign='center'>

          <Divider inverted section />

          <List horizontal inverted divided link size='small'>
            <List.Item as='a' href='#'>
              Site Map
            </List.Item>
            <List.Item as='a' href='#'>
              Contact Us
            </List.Item>
            <List.Item as='a' href='#'>
              Terms and Conditions
            </List.Item>
            <List.Item as='a' href='#'>
              Privacy Policy
            </List.Item>
          </List>
        </Container>
      </Segment>
    </div>
  );
}

export default App;
