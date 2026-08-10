import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const data = [
  {
    name: "Candidate A",
    votes: 400
  },
  {
    name: "Candidate B",
    votes: 300
  },
  {
    name: "Candidate C",
    votes: 200
  }
];

export default function ResultsChart() {

  return (

    <div className="bg-slate-800 p-6 rounded-2xl mt-8">

      <h2 className="text-2xl font-bold mb-4">
        Live Results
      </h2>

      <ResponsiveContainer width="100%" height={300}>

        <BarChart data={data}>

          <XAxis dataKey="name" />

          <YAxis />

          <Tooltip />

          <Bar dataKey="votes" />

        </BarChart>

      </ResponsiveContainer>

    </div>
  );
}
